import { useCallback } from 'react';

export const useRipple = () => {
  const createRipple = useCallback((event) => {
    const button = event.currentTarget;

    const existingRipple = button.querySelector('.ripple');
    if (existingRipple) {
      existingRipple.remove();
    }

    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight) * 2.5;
    const radius = diameter / 2;

    const rect = button.getBoundingClientRect();
    const touchX = event.clientX - rect.left;
    const touchY = event.clientY - rect.top;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${touchX - radius}px`;
    circle.style.top = `${touchY - radius}px`;
    circle.classList.add('ripple');

    button.appendChild(circle);

    setTimeout(() => {
      if (circle.parentNode) {
        circle.remove();
      }
    }, 800);
  }, []);

  return createRipple;
};
