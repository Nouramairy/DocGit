import { Component, input, output, signal, computed, effect, ElementRef, inject } from '@angular/core';
import { DocFile } from '../app';

export interface PresenceUser {
  id: string;
  name: string;
  initials: string;
  color: string;
  isTyping: boolean;
}

@Component({
  selector: 'app-editor',
  imports: [],
  templateUrl: './editor.html',
  styleUrl: './editor.css',
})
export class Editor {
  private hostEl = inject(ElementRef);
  private resizeTimer: any;

  file = input<DocFile | null>(null);
  contentChange = output<string>();
  shareClick = output<void>();
  newDocumentClick = output<void>();
  newFolderClick = output<void>();
  importFile = output<{ name: string; content: string }>();

  editableContent = signal('');
  wordCount = computed(() => {
    const text = this.editableContent().trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  });

  charCount = computed(() => this.editableContent().length);
  activeFormats = signal<Set<string>>(new Set());

  activeUsers = signal<PresenceUser[]>([
    { id: 'u2', name: 'Alice Chen', initials: 'AC', color: '#34a853', isTyping: true },
    { id: 'u4', name: 'Carol Zhang', initials: 'CZ', color: '#fbbc05', isTyping: false },
  ]);

  constructor() {
    effect(() => {
      const f = this.file();
      if (f) {
        this.editableContent.set(f.content || '');
        this.scheduleResize();
      }
    });
  }

  private scheduleResize(): void {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      const ta = this.hostEl.nativeElement.querySelector('.editor-textarea') as HTMLTextAreaElement | null;
      if (ta) {
        ta.value = this.editableContent();
        ta.style.height = 'auto';
        ta.style.height = Math.max(ta.scrollHeight, 600) + 'px';
      } else {
        this.scheduleResize();
      }
    }, 50);
  }

  onContentInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.editableContent.set(el.value);
    this.contentChange.emit(el.value);
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 600) + 'px';
  }

  formatAction(action: string): void {
    this.activeFormats.update(set => {
      const next = new Set(set);
      if (next.has(action)) {
        next.delete(action);
      } else {
        next.add(action);
      }
      return next;
    });
  }

  isFormatActive(action: string): boolean {
    return this.activeFormats().has(action);
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getPresenceTooltip(user: PresenceUser): string {
    return user.name + (user.isTyping ? ' (typing...)' : ' (viewing)');
  }

  triggerImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt,.html,.css,.js,.ts,.json,.xml,.csv,.yaml,.yml';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.importFile.emit({ name: file.name, content: reader.result as string });
      };
      reader.readAsText(file);
    };
    input.click();
  }
}
