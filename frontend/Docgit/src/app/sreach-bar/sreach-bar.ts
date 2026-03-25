import { Component, output, signal } from '@angular/core';

@Component({
  selector: 'app-sreach-bar',
  imports: [],
  templateUrl: './sreach-bar.html',
  styleUrl: './sreach-bar.css',
})
export class SreachBar {
  searchChange = output<string>();
  query = signal('');
  focused = signal(false);

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.searchChange.emit(value);
  }

  clearSearch(): void {
    this.query.set('');
    this.searchChange.emit('');
  }
}
