const Calculator = require('./Calculator');

var calc;

beforeEach(() => {
    calc = new Calculator();
});

test("Stores correctly", () => {
    calc.storeValue(3);
    expect(calc.storedValue).toBe(3);
})

test("Adds correctly", () => {
    expect(calc.add(1, 4)).toBe(5);
});

test("Multiplies correctly", () => {
    //Should fail
    expect(calc.multiply(2, 6)).toBe(11);
});

test("Exponents work correctly", () => {
    //Should fail
    expect(calc.exp(2, 4)).toBe(9);
})