import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddSubFolder } from './add-sub-folder';

describe('AddSubFolder', () => {
  let component: AddSubFolder;
  let fixture: ComponentFixture<AddSubFolder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddSubFolder]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddSubFolder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
