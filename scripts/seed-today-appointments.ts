/**
 * Seed "today" appointments for the default organisation.
 *
 * Idempotent and safe to run on every startup:
 *  - counts today's appointments for the organisation and stops at the target,
 *  - reads patients from the EMR data (the ones the seed created),
 *  - creates the missing patients when there are not enough,
 *  - only books a patient that does not already have an appointment today.
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/seed-today-appointments.ts
 */
import { NestFactory } from '@nestjs/core';
import { DataSource, IsNull } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PatientOrmEntity } from '../src/modules/patients/entities/patient.orm-entity';
import { AppointmentOrmEntity } from '../src/modules/appointments/entities/appointment.orm-entity';
import { generateNumber } from '../src/shared/utils/numbers';

const TARGET = Number(process.env.SEED_TODAY_APPOINTMENTS ?? 10);
const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'];

function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function log(message: string) {
  console.log(`[seed-today-appointments] ${message}`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const patients = dataSource.getRepository(PatientOrmEntity);
    const appointments = dataSource.getRepository(AppointmentOrmEntity);
    const date = today();

    // Default organisation: explicit env wins, otherwise infer it from the data
    // the EMR seed created (the most common organisation among patients).
    let organizationId = process.env.DEFAULT_ORGANIZATION_ID?.trim() || null;
    if (!organizationId) {
      const row = await patients
        .createQueryBuilder('p')
        .select('p.organization_id', 'org')
        .addSelect('COUNT(*)', 'n')
        .where('p.deleted_at IS NULL')
        .andWhere('p.organization_id IS NOT NULL')
        .groupBy('p.organization_id')
        .orderBy('n', 'DESC')
        .limit(1)
        .getRawOne<{ org: string }>();
      organizationId = row?.org ?? null;
    }
    if (!organizationId) {
      log('no organisation found — run the EMR seed first');
      process.exit(1);
    }
    log(`organisation=${organizationId} date=${date} target=${TARGET}`);

    const existingToday = await appointments.count({
      where: { organizationId, date, deletedAt: IsNull() },
    });
    log(`existing appointments today=${existingToday}`);
    if (existingToday >= TARGET) {
      log('already seeded — nothing to do');
      return;
    }

    // Patients: prefer the seeded ones, create the shortfall.
    let roster = await patients.find({
      where: { organizationId, deletedAt: IsNull() },
      take: TARGET,
      order: { createdAt: 'ASC' },
    });
    if (roster.length < TARGET) {
      const missing = TARGET - roster.length;
      log(`patients=${roster.length}, creating ${missing}`);
      for (let i = 0; i < missing; i += 1) {
        const created = patients.create({
          patientId: generateNumber('MRN'),
          firstName: `Patient`,
          lastName: `${roster.length + i + 1}`,
          organizationId,
          locationId: roster[0]?.locationId ?? null,
        });
        roster.push(await patients.save(created));
      }
    }

    let booked = 0;
    for (const [index, patient] of roster.slice(0, TARGET).entries()) {
      // Idempotency: one appointment per patient per day. Raw SQL keeps this
      // script independent of the entity's optional-column typings.
      const already: Array<{ appointment_number: string }> = await dataSource.query(
        `select appointment_number from appointments
          where patient_id = $1 and date = $2 and deleted_at is null limit 1`,
        [patient.patientId, date],
      );
      if (already.length) {
        log(`patient ${patient.patientId} already booked (${already[0].appointment_number})`);
        continue;
      }

      const slot = SLOTS[index % SLOTS.length];
      const appointmentNumber = generateNumber('APT');
      await dataSource.query(
        `insert into appointments
           (appointment_number, patient_id, patient_name, appointment_type,
            modality, date, start_time, status, priority, organization_id,
            location_id, created_at, updated_at)
         values ($1,$2,$3,'CONSULTATION',$4,$5,$6,'SCHEDULED','ROUTINE',$7,$8,now(),now())`,
        [
          appointmentNumber,
          patient.patientId,
          [patient.firstName, patient.lastName].filter(Boolean).join(' '),
          index % 2 === 0 ? 'VIDEO' : 'IN_PERSON',
          date,
          slot,
          organizationId,
          patient.locationId ?? null,
        ],
      );
      booked += 1;
      log(`booked ${appointmentNumber} patient=${patient.patientId} slot=${slot}`);
    }

    const total = await appointments.count({
      where: { organizationId, date, deletedAt: IsNull() },
    });
    log(`done — booked=${booked} today=${total}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('[seed-today-appointments] failed', error);
  process.exit(1);
});
