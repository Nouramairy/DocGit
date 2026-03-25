import { Component, input, output, signal, computed, effect } from '@angular/core';
import { DocFile } from '../app';

@Component({
  selector: 'app-editor',
  imports: [],
  templateUrl: './editor.html',
  styleUrl: './editor.css',
})
export class Editor {
  file = input<DocFile | null>(null);
  contentChange = output<string>();

  editableContent = signal('');
  wordCount = computed(() => {
    const text = this.editableContent().trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  });

  charCount = computed(() => this.editableContent().length);

  activeFormats = signal<Set<string>>(new Set());

  constructor() {
    effect(() => {
      const f = this.file();
      if (f) {
        this.editableContent.set(f.content || '');
      }
    });
  }

  onContentInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.editableContent.set(el.value);
    this.contentChange.emit(el.value);
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
}
