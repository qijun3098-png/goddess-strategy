import { createElement, type ImgHTMLAttributes } from 'react';
export default function TestImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  return createElement('img', { src: props.src, alt: props.alt ?? '', width: props.width, height: props.height });
}
