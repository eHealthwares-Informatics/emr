import { Column, Entity, Index } from 'typeorm';
import { EmrBaseEntity } from '../../emr-base.entity';
import type { PaymentProviderType } from '../../../shared/domain/enums';

@Entity('payment_providers')
export class PaymentProviderOrmEntity extends EmrBaseEntity {
  @Index({ unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  type!: PaymentProviderType;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'contact_phone', type: 'text', nullable: true })
  contactPhone!: string | null;

  @Column({ name: 'contact_email', type: 'text', nullable: true })
  contactEmail!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
