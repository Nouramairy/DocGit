import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeletedItems } from './deleted-items';

describe('DeletedItems', () => {
  let component: DeletedItems;
  let fixture: ComponentFixture<DeletedItems>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeletedItems]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeletedItems);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
