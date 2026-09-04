// Categorías oficiales de balonmano (estructura RFEBM: base × género).
const BASE_CATEGORIES = ['Prebenjamín', 'Benjamín', 'Alevín', 'Infantil', 'Cadete', 'Juvenil', 'Junior', 'Senior'];
const GENDERS = ['Masculino', 'Femenino'];

export const CATEGORIES = BASE_CATEGORIES.flatMap((base) => GENDERS.map((gender) => `${base} ${gender}`));
