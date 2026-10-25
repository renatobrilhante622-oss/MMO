import {describe,expect,it} from 'vitest';
import {MENU_ICON_NAMES,menuIcon} from '../src/ui/MenuIcons';

describe('shared vector menu emblems',()=>{
  it('ships an inline scalable icon for every navigation action without platform glyph dependencies',()=>{
    for(const name of MENU_ICON_NAMES){
      const icon=menuIcon(name);
      expect(icon).toContain(`data-menu-icon="${name}"`);
      expect(icon).toContain('viewBox="0 0 32 32"');
      expect(icon).toContain('aria-hidden="true"');
      expect(icon).toContain('<path');
      expect(icon).not.toContain('<img');
    }
    expect(menuIcon('arena')).not.toBe(menuIcon('gather'));
    expect(menuIcon('gather')).not.toBe(menuIcon('rewards'));
    expect(menuIcon('close')).not.toBe(menuIcon('arena'));
  });

  it('escapes accessible labels and never interpolates an unknown icon name into markup',()=>{
    const icon=menuIcon('arena','Arena "<script>');
    expect(icon).toContain('role="img"');
    expect(icon).toContain('aria-label="Arena &quot;&lt;script&gt;"');
    expect(icon).not.toContain('<script>');
    expect(menuIcon('" onload="alert(1)')).toBe(menuIcon('quest'));
    expect(menuIcon('__proto__')).toBe(menuIcon('quest'));
  });
});
