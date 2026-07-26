import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

jest.mock('@upstash/redis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    })),
  };
});

describe('RedisService', () => {
  let service: RedisService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
          UPSTASH_REDIS_REST_TOKEN: 'token123',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    service = new RedisService(configService);
  });

  it('get delega en el cliente Redis', async () => {
    (service.client.get as jest.Mock).mockResolvedValue('cached-value');
    const result = await service.get('some-key');
    expect(result).toBe('cached-value');
    expect(service.client.get).toHaveBeenCalledWith('some-key');
  });

  it('set sin ttl llama set sin opciones', async () => {
    await service.set('key', { foo: 'bar' });
    expect(service.client.set).toHaveBeenCalledWith('key', { foo: 'bar' });
  });

  it('set con ttl llama set con ex', async () => {
    await service.set('key', { foo: 'bar' }, 300);
    expect(service.client.set).toHaveBeenCalledWith(
      'key',
      { foo: 'bar' },
      { ex: 300 },
    );
  });

  it('del delega en el cliente Redis', async () => {
    await service.del('key');
    expect(service.client.del).toHaveBeenCalledWith('key');
  });

  describe('getOrSet', () => {
    it('retorna el valor cacheado sin llamar fn si existe', async () => {
      (service.client.get as jest.Mock).mockResolvedValue('cached');
      const fn = jest.fn().mockResolvedValue('fresh');

      const result = await service.getOrSet('key', 60, fn);

      expect(result).toBe('cached');
      expect(fn).not.toHaveBeenCalled();
    });

    it('ejecuta fn y cachea el resultado si no hay valor cacheado', async () => {
      (service.client.get as jest.Mock).mockResolvedValue(null);
      const fn = jest.fn().mockResolvedValue('fresh');

      const result = await service.getOrSet('key', 60, fn);

      expect(result).toBe('fresh');
      expect(fn).toHaveBeenCalled();
      expect(service.client.set).toHaveBeenCalledWith('key', 'fresh', {
        ex: 60,
      });
    });
  });
});
