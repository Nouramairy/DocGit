import { Component, input, output, signal, ElementRef, viewChild, afterNextRender } from '@angular/core';

@Component({
  selector: 'app-add-sub-folder',
  imports: [],
  templateUrl: './add-sub-folder.html',
  styleUrl: './add-sub-folder.css',
})
export class AddSubFolder {
  parentFolderName = input<string>('');
  parentFolderId = input<string>('');

  create = output<{ name: string; parentId: string }>();
  cancel = output<void>();

  folderName = signal('');
  inputRef = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    afterNextRender(() => {
      this.inputRef()?.nativeElement.focus();
    });
  }

  onSubmit(): void {
    const name = this.folderName().trim();
    if (name) {
      this.create.emit({ name, parentId: this.parentFolderId() });
    }
  }

  onInput(event: Event): void {
    this.folderName.set((event.target as HTMLInputElement).value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSubmit();
    } else if (event.key === 'Escape') {
      this.cancel.emit();
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cancel.emit();
    }
  }
}
