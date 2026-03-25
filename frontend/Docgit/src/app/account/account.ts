import { Component, output, signal, ElementRef, inject, HostListener } from '@angular/core';

@Component({
  selector: 'app-account',
  imports: [],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  logOut = output<void>();
  close = output<void>();

  private elRef = inject(ElementRef);

  user = signal({
    name: 'John Doe',
    email: 'john.doe@example.com',
    initials: 'JD',
    plan: 'Pro',
    documentsCount: 12,
    storageUsed: '2.4 GB',
    storageTotal: '15 GB',
    storagePercent: 16,
    memberSince: 'January 2026',
  });

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
