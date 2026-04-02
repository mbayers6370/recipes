export type SeasonalProduceMonth = {
  fruits: string[];
  vegetables: string[];
};

export const US_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const US_SEASONAL_PRODUCE_BY_MONTH: SeasonalProduceMonth[] = [
  {
    fruits: ["Blood oranges", "Grapefruit", "Kiwifruit", "Lemons", "Pears", "Tangerines"],
    vegetables: ["Beets", "Brussels sprouts", "Cabbage", "Carrots", "Kale", "Sweet potatoes"],
  },
  {
    fruits: ["Grapefruit", "Kumquats", "Lemons", "Oranges", "Pears", "Tangerines"],
    vegetables: ["Broccoli", "Cabbage", "Carrots", "Cauliflower", "Collards", "Turnips"],
  },
  {
    fruits: ["Avocados", "Grapefruit", "Kumquats", "Lemons", "Oranges", "Pineapple"],
    vegetables: ["Artichokes", "Asparagus", "Broccoli", "Cabbage", "Leeks", "Spinach"],
  },
  {
    fruits: ["Apricots", "Avocados", "Lemons", "Loquats", "Pineapple", "Strawberries"],
    vegetables: ["Artichokes", "Asparagus", "Fava beans", "Peas", "Radishes", "Spinach"],
  },
  {
    fruits: ["Apricots", "Cherries", "Mangoes", "Pineapple", "Strawberries", "Watermelon"],
    vegetables: ["Asparagus", "Green beans", "Lettuce", "Peas", "Radishes", "Rhubarb"],
  },
  {
    fruits: ["Blackberries", "Blueberries", "Cherries", "Peaches", "Plums", "Strawberries"],
    vegetables: ["Corn", "Cucumbers", "Green beans", "Summer squash", "Tomatoes", "Zucchini"],
  },
  {
    fruits: ["Blackberries", "Blueberries", "Cantaloupe", "Peaches", "Raspberries", "Watermelon"],
    vegetables: ["Corn", "Cucumbers", "Eggplant", "Peppers", "Tomatoes", "Zucchini"],
  },
  {
    fruits: ["Blackberries", "Figs", "Grapes", "Melons", "Nectarines", "Peaches"],
    vegetables: ["Corn", "Eggplant", "Okra", "Peppers", "Tomatoes", "Zucchini"],
  },
  {
    fruits: ["Apples", "Figs", "Grapes", "Pears", "Plums", "Raspberries"],
    vegetables: ["Broccoli", "Cauliflower", "Corn", "Eggplant", "Pumpkin", "Sweet peppers"],
  },
  {
    fruits: ["Apples", "Cranberries", "Grapes", "Pears", "Persimmons", "Pomegranates"],
    vegetables: ["Beets", "Broccoli", "Cauliflower", "Pumpkin", "Sweet potatoes", "Winter squash"],
  },
  {
    fruits: ["Apples", "Cranberries", "Kiwifruit", "Oranges", "Pears", "Pomegranates"],
    vegetables: ["Beets", "Brussels sprouts", "Cabbage", "Kale", "Parsnips", "Turnips"],
  },
  {
    fruits: ["Grapefruit", "Kiwifruit", "Oranges", "Pears", "Pomelos", "Tangerines"],
    vegetables: ["Brussels sprouts", "Cabbage", "Carrots", "Collards", "Leeks", "Sweet potatoes"],
  },
];

export function getUSSeasonalProduceForMonth(monthIndex: number) {
  return US_SEASONAL_PRODUCE_BY_MONTH[monthIndex] ?? US_SEASONAL_PRODUCE_BY_MONTH[0];
}
