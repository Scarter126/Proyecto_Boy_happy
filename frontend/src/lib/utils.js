/**
 * Utility functions for React components
 */

/**
 * Combines class names conditionally
 * A lightweight alternative to clsx/classnames
 *
 * @param {...(string|undefined|null|false)} classes - Class names to combine
 * @returns {string} Combined class names
 *
 * @example
 * cn('base', condition && 'conditional', 'always')
 * // => 'base conditional always' (if condition is true)
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default {
  cn
};
