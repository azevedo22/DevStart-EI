import { InjectionToken } from '@angular/core';

/**
 * URL base da API. Em desenvolvimento, '/api/v1' passa pelo proxy do dev server
 * (proxy.conf.json) até ao API Gateway; em produção, o mesmo caminho é servido
 * pelo reverse proxy. Assim não há URLs fixos no código.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api/v1',
});
