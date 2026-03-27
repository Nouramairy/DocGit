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
  activeFormats = signal<Set<string>>(new Set());

  private undoStack: { text: string; cursor: number }[] = [];
  private redoStack: { text: string; cursor: number }[] = [];
  private lastContent = '';
  private currentFileId: string | null = null;

  activeUsers = signal<PresenceUser[]>([
    { id: 'u2', name: 'Alice Chen', initials: 'AC', color: '#34a853', isTyping: true },
    { id: 'u4', name: 'Carol Zhang', initials: 'CZ', color: '#fbbc05', isTyping: false },
  ]);

  constructor() {
    effect(() => {
      const f = this.file();
      if (f && f.id !== this.currentFileId) {
        this.currentFileId = f.id;
        this.editableContent.set(f.content || '');
        this.lastContent = f.content || '';
        this.undoStack = [];
        this.redoStack = [];
        this.scheduleResize();
      }
    });
  }

  private getTextarea(): HTMLTextAreaElement | null {
    return this.hostEl.nativeElement.querySelector('.editor-textarea');
  }

  private scheduleResize(): void {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      const ta = this.getTextarea();
      if (ta) {
        ta.value = this.editableContent();
        ta.style.height = 'auto';
        ta.style.height = Math.max(ta.scrollHeight, 600) + 'px';
      } else {
        this.scheduleResize();
      }
    }, 50);
  }

  private pushUndo(ta: HTMLTextAreaElement): void {
    this.undoStack.push({ text: ta.value, cursor: ta.selectionStart });
    this.redoStack = [];
  }

  private applyValue(ta: HTMLTextAreaElement, newValue: string, cursorPos: number): void {
    ta.value = newValue;
    this.lastContent = newValue;
    this.editableContent.set(newValue);
    this.contentChange.emit(newValue);
    ta.style.height = 'auto';
    ta.style.height = Math.max(ta.scrollHeight, 600) + 'px';
    ta.focus();
    ta.setSelectionRange(cursorPos, cursorPos);
  }

  onContentInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.undoStack.push({ text: this.lastContent, cursor: el.selectionStart });
    this.redoStack = [];
    this.lastContent = el.value;
    this.editableContent.set(el.value);
    this.contentChange.emit(el.value);
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 600) + 'px';
  }

  undo(): void {
    const ta = this.getTextarea();
    if (!ta || this.undoStack.length === 0) return;
    this.redoStack.push({ text: ta.value, cursor: ta.selectionStart });
    const prev = this.undoStack.pop()!;
    this.applyValue(ta, prev.text, prev.cursor);
  }

  redo(): void {
    const ta = this.getTextarea();
    if (!ta || this.redoStack.length === 0) return;
    this.undoStack.push({ text: ta.value, cursor: ta.selectionStart });
    const next = this.redoStack.pop()!;
    this.applyValue(ta, next.text, next.cursor);
  }

  wrapSelection(prefix: string, suffix: string): void {
    const ta = this.getTextarea();
    if (!ta) return;
    this.pushUndo(ta);

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.substring(start, end);

    if (selected.startsWith(prefix) && selected.endsWith(suffix)) {
      const unwrapped = selected.slice(prefix.length, selected.length - suffix.length);
      const newText = text.substring(0, start) + unwrapped + text.substring(end);
      this.applyValue(ta, newText, start + unwrapped.length);
    } else if (
      start >= prefix.length &&
      text.substring(start - prefix.length, start) === prefix &&
      text.substring(end, end + suffix.length) === suffix
    ) {
      const newText = text.substring(0, start - prefix.length) + selected + text.substring(end + suffix.length);
      this.applyValue(ta, newText, start - prefix.length + selected.length);
    } else {
      const wrapped = prefix + (selected || 'text') + suffix;
      const newText = text.substring(0, start) + wrapped + text.substring(end);
      this.applyValue(ta, newText, start + prefix.length);
      ta.setSelectionRange(start + prefix.length, start + prefix.length + (selected || 'text').length);
    }
  }

  prefixLines(prefix: string): void {
    const ta = this.getTextarea();
    if (!ta) return;
    this.pushUndo(ta);

    const text = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', end);
    const blockEnd = lineEnd === -1 ? text.length : lineEnd;

    const block = text.substring(lineStart, blockEnd);
    const lines = block.split('\n');

    const allPrefixed = lines.every(l => l.startsWith(prefix));
    const newLines = allPrefixed
      ? lines.map(l => l.substring(prefix.length))
      : lines.map(l => prefix + l);

    const newBlock = newLines.join('\n');
    const newText = text.substring(0, lineStart) + newBlock + text.substring(blockEnd);
    const cursorOffset = allPrefixed ? -prefix.length : prefix.length;

    this.applyValue(ta, newText, Math.max(lineStart, start + cursorOffset));
  }

  numberedList(): void {
    const ta = this.getTextarea();
    if (!ta) return;
    this.pushUndo(ta);

    const text = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', end);
    const blockEnd = lineEnd === -1 ? text.length : lineEnd;

    const block = text.substring(lineStart, blockEnd);
    const lines = block.split('\n');

    const allNumbered = lines.every(l => /^\d+\.\s/.test(l));
    const newLines = allNumbered
      ? lines.map(l => l.replace(/^\d+\.\s/, ''))
      : lines.map((l, i) => `${i + 1}. ${l}`);

    const newBlock = newLines.join('\n');
    const newText = text.substring(0, lineStart) + newBlock + text.substring(blockEnd);
    this.applyValue(ta, newText, lineStart + newBlock.length);
  }

  heading(level: number): void {
    const prefix = '#'.repeat(level) + ' ';
    const ta = this.getTextarea();
    if (!ta) return;
    this.pushUndo(ta);

    const text = ta.value;
    const start = ta.selectionStart;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const blockEnd = lineEnd === -1 ? text.length : lineEnd;
    const line = text.substring(lineStart, blockEnd);

    const existingMatch = line.match(/^(#{1,6})\s/);
    let newLine: string;
    if (existingMatch && existingMatch[1].length === level) {
      newLine = line.substring(existingMatch[0].length);
    } else if (existingMatch) {
      newLine = prefix + line.substring(existingMatch[0].length);
    } else {
      newLine = prefix + line;
    }

    const newText = text.substring(0, lineStart) + newLine + text.substring(blockEnd);
    this.applyValue(ta, newText, lineStart + newLine.length);
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
