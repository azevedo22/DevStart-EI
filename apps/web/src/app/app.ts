import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './core/layout/navbar/navbar';

@Component({
  selector: 'ds-root',
  imports: [RouterOutlet, Navbar],
  template: `
    <ds-navbar />
    <main>
      <router-outlet />
    </main>
  `,
})
export class App {}
