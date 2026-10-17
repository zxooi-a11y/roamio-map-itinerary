import test from 'node:test';
import assert from 'node:assert/strict';
import { insidePolygon, orderByNearest } from './grouping.js';

test('lasso hit test', () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(insidePolygon({ x: 5, y: 5 }, square), true);
  assert.equal(insidePolygon({ x: 15, y: 5 }, square), false);
  const vee = [{ x: 0, y: 0 }, { x: 5, y: 8 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
  assert.equal(insidePolygon({ x: 5, y: 2 }, vee), false); // in the notch
});

test('places are ordered so each next one is the closest', () => {
  // along a line, given out of order: A(0) D(3) B(1) C(2)
  const P = (name, lng) => ({ name, lat: 0, lng: lng / 100 });
  const order = orderByNearest([P('A', 0), P('D', 3), P('B', 1), P('C', 2)]).map((p) => p.name);
  assert.ok(order.join('') === 'ABCD' || order.join('') === 'DCBA', order.join(''));
  // starting from where the day already ends (near D): D first
  assert.deepEqual(orderByNearest([P('A', 0), P('D', 3), P('B', 1), P('C', 2)], { lat: 0, lng: 0.05 }).map((p) => p.name), ['D', 'C', 'B', 'A']);
  assert.equal(orderByNearest([]).length, 0);
});
