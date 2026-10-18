import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

// Ordered-list / queue glyph: three stacked rows, each with a leading marker
// dot and a horizontal line, in the same 48x40 canvas used by the other tab icons.
const ROWS_Y = [9, 16, 23];
const LINES_PATH = ROWS_Y.map(y => `M20.5 ${y}H34.5`).join('');

export const QueueIconOutline = () => {
  return (
    <Svg width="48" height="40" viewBox="0 0 48 40" fill="none">
      {ROWS_Y.map(y => (
        <Circle key={y} cx="15" cy={y} r="2" stroke="#171717" strokeWidth="1.5" />
      ))}
      <Path d={LINES_PATH} stroke="#171717" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
};

export const QueueIconFilled = () => {
  return (
    <Svg width="48" height="40" viewBox="0 0 48 40" fill="none">
      {ROWS_Y.map(y => (
        <Circle key={y} cx="15" cy={y} r="2" fill="#171717" stroke="#171717" strokeWidth="1.5" />
      ))}
      <Path d={LINES_PATH} stroke="#171717" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
};
