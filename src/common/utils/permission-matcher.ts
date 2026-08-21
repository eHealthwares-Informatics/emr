export function permissionMatches(userPerm: string, requiredCode: string): boolean {
  if (userPerm === '*') return true;

  const userParts = userPerm.split('.');
  const requiredParts = requiredCode.split('.');

  for (let i = 0; i < userParts.length; i++) {
    if (userParts[i] === '*') {
      if (i === userParts.length - 1) return true;
      continue;
    }
    if (i >= requiredParts.length) return false;
    if (userParts[i] !== requiredParts[i]) return false;
  }

  return userParts.length === requiredParts.length;
}
