import { carePresenceChannel, isOtherOnline, presenceCaption } from '../carePresence';

describe('carePresence («En línea» en el chat de cuidado)', () => {
  it('canal por vinculación', () => {
    expect(carePresenceChannel('abc-123')).toBe('care-presence:abc-123');
  });
  it('en línea solo si la otra persona está en el canal', () => {
    expect(isOtherOnline({ yo: [{}], otro: [{}] }, 'otro')).toBe(true);
    expect(isOtherOnline({ yo: [{}] }, 'otro')).toBe(false);
    expect(isOtherOnline({ otro: [] }, 'otro')).toBe(false);
    expect(isOtherOnline(null, 'otro')).toBe(false);
    expect(isOtherOnline({ otro: [{}] }, null)).toBe(false);
  });
  it('texto de la cabecera', () => {
    expect(presenceCaption(true, 'Tu cuidador/a')).toBe('En línea');
    expect(presenceCaption(false, 'Tu cuidador/a')).toBe('Tu cuidador/a');
  });
});
