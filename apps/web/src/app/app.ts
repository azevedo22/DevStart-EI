import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './core/layout/navbar/navbar';
import { DemoBanner } from './features/demo/components/demo-banner/demo-banner';

@Component({
  selector: 'ds-root',
  imports: [RouterOutlet, Navbar, DemoBanner],
  template: `
    <ds-navbar />
    <ds-demo-banner />
    <main>
      <router-outlet />
    </main>
  `,
})
export class App {}
