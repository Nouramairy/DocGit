import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminLogInPanel } from './admin-log-in-panel';

describe('AdminLogInPanel', () => {
  let component: AdminLogInPanel;
  let fixture: ComponentFixture<AdminLogInPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLogInPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminLogInPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
