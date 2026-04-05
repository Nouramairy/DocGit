import { Component, output, input, ElementRef, inject, HostListener } from '@angular/core';

@Component({
  selector: 'app-account',
  imports: [],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  logOut = output<void>();
  close = output<void>();
  documentCount = input(0);
  displayName = input('');
  email = input('');
  initials = input('?');

  private elRef = inject(ElementRef);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.close.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  onLogOut(): void {
    this.logOut.emit();
  }
}
