/**
 * DOM utility functions
 */

export function $(id) {
  return document.getElementById(id);
}

export function $$(selector) {
  return document.querySelectorAll(selector);
}

export function on(element, event, handler) {
  if (element.addEventListener) {
    element.addEventListener(event, handler);
  } else {
    element.attachEvent('on' + event, handler);
  }
}

export function off(element, event, handler) {
  if (element.removeEventListener) {
    element.removeEventListener(event, handler);
  } else {
    element.detachEvent('on' + event, handler);
  }
}

export function createElement(tag, className, innerHTML) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (innerHTML) element.innerHTML = innerHTML;
  return element;
}

export function addClass(element, className) {
  element.classList.add(className);
}

export function removeClass(element, className) {
  element.classList.remove(className);
}

export function hasClass(element, className) {
  return element.classList.contains(className);
}

export function toggleClass(element, className) {
  element.classList.toggle(className);
}