import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SreachBar } from './sreach-bar';

describe('SreachBar', () => {
  let component: SreachBar;
  let fixture: ComponentFixture<SreachBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SreachBar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SreachBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
