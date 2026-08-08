import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService, TokenPair } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<TokenPair> {
    return this.authService.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  // T062 — Google OAuth: NextAuth ya autenticó con Google, esto crea/vincula el User.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('oauth/google')
  oauthGoogle(@Body() dto: GoogleAuthDto): Promise<TokenPair> {
    return this.authService.loginWithGoogleProfile(dto.idToken);
  }
}
