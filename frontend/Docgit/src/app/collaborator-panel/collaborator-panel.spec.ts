import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollaboratorPanel } from './collaborator-panel';

describe('CollaboratorPanel', () => {
  let component: CollaboratorPanel;
  let fixture: ComponentFixture<CollaboratorPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollaboratorPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CollaboratorPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
