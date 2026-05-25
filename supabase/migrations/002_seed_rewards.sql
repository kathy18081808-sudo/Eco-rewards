-- Clear existing rewards before re-seeding
delete from public.rewards;

insert into public.rewards (name, description, image_url, points_cost, category, brand) values
  -- COFFEE (8 items)
  ('Tall Brewed Coffee', 'A classic tall brewed coffee, bold and smooth.', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop', 200, 'coffee', 'Starbucks'),
  ('Caramel Macchiato', 'Espresso with vanilla syrup, steamed milk, and caramel drizzle.', 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400&h=400&fit=crop', 300, 'coffee', 'Starbucks'),
  ('Mocha Frappuccino', 'Blended mocha with coffee, milk, ice, and whipped cream.', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop', 350, 'coffee', 'Starbucks'),
  ('Vanilla Latte', 'Smooth espresso with steamed milk and vanilla syrup.', 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=400&fit=crop', 280, 'coffee', 'Starbucks'),
  ('Cappuccino', 'Rich espresso topped with a thick layer of foamed milk.', 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=400&h=400&fit=crop', 250, 'coffee', 'Starbucks'),
  ('Iced Americano', 'Espresso shots topped with cold water and ice.', 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&h=400&fit=crop', 220, 'coffee', 'Starbucks'),
  ('McCafe Latte', 'Creamy espresso latte made with whole milk.', 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=400&h=400&fit=crop', 200, 'coffee', 'McDonalds'),
  ('Dunkin Iced Coffee', 'Smooth iced coffee with your choice of flavor.', 'https://images.unsplash.com/photo-1592663527359-cf6642f54cff?w=400&h=400&fit=crop', 220, 'coffee', 'Dunkin'),

  -- FOOD (10 items)
  ('Big Mac', 'Two all-beef patties, special sauce, lettuce, cheese, on a sesame seed bun.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop', 400, 'food', 'McDonalds'),
  ('McChicken', 'Crispy chicken patty with shredded lettuce and mayo.', 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=400&fit=crop', 250, 'food', 'McDonalds'),
  ('Quarter Pounder', 'Fresh beef quarter pound patty with cheese, onions, pickles.', 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=400&fit=crop', 380, 'food', 'McDonalds'),
  ('Happy Meal', 'A fun meal with burger, fries, drink, and a toy inside.', 'https://images.unsplash.com/photo-1619881590738-a111d176d936?w=400&h=400&fit=crop', 300, 'food', 'McDonalds'),
  ('Chicken Nuggets 10pc', 'Ten pieces of golden crispy chicken McNuggets.', 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=400&fit=crop', 300, 'food', 'McDonalds'),
  ('Whopper', 'Flame-grilled beef patty with tomato, lettuce, mayo, and onions.', 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=400&fit=crop', 380, 'food', 'Burger King'),
  ('Subway Footlong', 'A 12-inch sub sandwich with your choice of fresh toppings.', 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&h=400&fit=crop', 350, 'food', 'Subway'),
  ('Pizza Slice', 'A classic New York-style cheese pizza slice.', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop', 250, 'food', 'Pizza Hut'),
  ('Chicken Burrito', 'Grilled chicken wrapped in a flour tortilla with rice and beans.', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=400&fit=crop', 350, 'food', 'Chipotle'),
  ('Taco Combo', 'Two seasoned beef tacos with lettuce, cheese, and salsa.', 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=400&fit=crop', 280, 'food', 'Taco Bell'),

  -- DRINKS (8 items)
  ('Bottled Water 6-Pack', 'Pack of six 500ml natural spring water bottles.', 'https://images.unsplash.com/photo-1560023907-5f339617ea30?w=400&h=400&fit=crop', 250, 'drinks', 'Generic'),
  ('Fresh Orange Juice', 'Freshly squeezed orange juice, no pulp.', 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=400&fit=crop', 220, 'drinks', 'Generic'),
  ('Berry Smoothie', 'Blended mix of strawberry, blueberry, and banana.', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=400&fit=crop', 300, 'drinks', 'Jamba Juice'),
  ('Mango Smoothie', 'Tropical mango blended with yogurt and ice.', 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=400&fit=crop', 300, 'drinks', 'Jamba Juice'),
  ('Iced Tea Lemon', 'Refreshing iced black tea with a squeeze of lemon.', 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop', 200, 'drinks', 'Generic'),
  ('Lemonade', 'Classic freshly squeezed lemonade, sweet and tangy.', 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&h=400&fit=crop', 200, 'drinks', 'Generic'),
  ('Green Tea', 'Hot or iced Japanese green tea, antioxidant-rich.', 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&h=400&fit=crop', 200, 'drinks', 'Generic'),
  ('Coconut Water', 'Pure coconut water, naturally refreshing and hydrating.', 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&h=400&fit=crop', 220, 'drinks', 'Generic'),

  -- SNACKS (8 items)
  ('Medium Fries', 'Golden crispy French fries, perfectly salted.', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop', 200, 'snacks', 'McDonalds'),
  ('Large Fries', 'Generous portion of golden crispy French fries.', 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=400&h=400&fit=crop', 250, 'snacks', 'McDonalds'),
  ('Apple Pie', 'Warm baked apple pie with a crispy crust.', 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=400&h=400&fit=crop', 200, 'snacks', 'McDonalds'),
  ('Chocolate Chip Cookie', 'Freshly baked chocolate chip cookie, soft and chewy.', 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&h=400&fit=crop', 200, 'snacks', 'Subway'),
  ('Churros', 'Warm cinnamon sugar churros with chocolate dipping sauce.', 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=400&fit=crop', 250, 'snacks', 'Generic'),
  ('Soft Pretzel', 'Warm and salty soft pretzel with mustard dip.', 'https://images.unsplash.com/photo-1600626336005-ede927a3b22d?w=400&h=400&fit=crop', 220, 'snacks', 'Generic'),
  ('Ice Cream Cone', 'Creamy vanilla soft-serve in a waffle cone.', 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&h=400&fit=crop', 200, 'snacks', 'McDonalds'),
  ('Donut Glazed', 'Classic glazed donut, light and fluffy.', 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=400&fit=crop', 200, 'snacks', 'Dunkin');
