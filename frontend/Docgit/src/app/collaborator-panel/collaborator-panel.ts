import { Component, output, signal, computed } from '@angular/core';

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  role: 'viewer' | 'editor' | 'admin';
  isOnline: boolean;
  isTyping: boolean;
}

@Component({
  selector: 'app-collaborator-panel',
  imports: [],
  templateUrl: './collaborator-panel.html',
  styleUrl: './collaborator-panel.css',
})
export class CollaboratorPanel {
  close = output<void>();

  inviteEmail = signal('');
  inviteRole = signal<'viewer' | 'editor'>('editor');
  linkCopied = signal(false);
  showRoleDropdown = signal<string | null>(null);

  collaborators = signal<Collaborator[]>([
    { id: 'u1', name: 'John Doe', email: 'john@example.com', initials: 'JD', color: '#4285f4', role: 'admin', isOnline: true, isTyping: true },
    { id: 'u2', name: 'Alice Chen', email: 'alice@example.com', initials: 'AC', color: '#34a853', role: 'editor', isOnline: true, isTyping: false },
    { id: 'u3', name: 'Bob Smith', email: 'bob@example.com', initials: 'BS', color: '#ea4335', role: 'editor', isOnline: false, isTyping: false },
    { id: 'u4', name: 'Carol Zhang', email: 'carol@example.com', initials: 'CZ', color: '#fbbc05', role: 'viewer', isOnline: true, isTyping: false },
  ]);

  onlineCount = computed(() => this.collaborators().filter(c => c.isOnline).length);

  onEmailInput(event: Event): void {
    this.inviteEmail.set((event.target as HTMLInputElement).value);
  }

  setInviteRole(role: 'viewer' | 'editor'): void {
    this.inviteRole.set(role);
  }

  sendInvite(): void {
    const email = this.inviteEmail().trim();
    if (!email) return;

    const name = email.split('@')[0];
    const initials = name.slice(0, 2).toUpperCase();
    const colors = ['#9c27b0', '#ff5722', '#009688', '#795548', '#607d8b'];
    const color = colors[this.collaborators().length % colors.length];

    const newCollab: Collaborator = {
      id: Date.now().toString(),
      name,
      email,
      initials,
      color,
      role: this.inviteRole(),
      isOnline: false,
      isTyping: false,
    };

    this.collaborators.update(list => [...list, newCollab]);
    this.inviteEmail.set('');
  }

  onInviteKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.sendInvite();
  }

  changeRole(userId: string, role: 'viewer' | 'editor' | 'admin'): void {
    this.collaborators.update(list =>
      list.map(c => c.id === userId ? { ...c, role } : c)
    );
    this.showRoleDropdown.set(null);
  }

  toggleRoleDropdown(userId: string): void {
    this.showRoleDropdown.update(cur => cur === userId ? null : userId);
  }

  removeCollaborator(userId: string): void {
    this.collaborators.update(list => list.filter(c => c.id !== userId));
    this.showRoleDropdown.set(null);
  }

  copyLink(): void {
    this.linkCopied.set(true);
    setTimeout(() => this.linkCopied.set(false), 2000);
  }

  getRoleIcon(role: string): string {
    if (role === 'admin') return 'admin_panel_settings';
    if (role === 'editor') return 'edit';
    return 'visibility';
  }

  getRoleLabel(role: string): string {
    if (role === 'admin') return 'Admin';
    if (role === 'editor') return 'Can edit';
    return 'Can view';
  }

  getStatusText(collab: Collaborator): string {
    if (collab.isTyping) return 'Typing...';
    if (collab.isOnline) return 'Online';
    return 'Offline';
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('panel-overlay')) {
      this.close.emit();
    }
  }
}
