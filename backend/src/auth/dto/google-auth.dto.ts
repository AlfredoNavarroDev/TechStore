import { IsNotEmpty } from 'class-validator';

/**
 * NextAuth hace el intercambio OAuth con Google y nos pasa el id_token crudo —
 * el backend lo verifica acá (firma + audiencia) antes de confiar en el email
 * (research.md §2). Nunca se confía en un email/nombre enviados sin verificar.
 */
export class GoogleAuthDto {
  @IsNotEmpty()
  idToken: string;
}
