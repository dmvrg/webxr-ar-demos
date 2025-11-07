export const BurgerNames = {
    '': { name: 'THE VOID', description: 'Nothing but bun and \npure nothingness.', price: '11' },
    'onion': { name: 'TEARJERKER', description: 'Sharp bite that \nbrings tears of joy.', price: '12' },
    'tomato': { name: 'RED HALO', description: 'Bright, juicy, \na halo of flavor.', price: '12' },
    'lettuce': { name: 'LEAF WHISPER', description: 'Crisp greens that \nspeak in silence.', price: '11' },
    'cheese': { name: 'MELT BOMB', description: 'Soft, molten, and \ndangerously good.', price: '13' },
    'patty': { name: 'SOLO TITAN', description: 'One patty. All power. \nNothing else.', price: '13' },
    'onion,tomato': { name: 'CRIMSON CRY', description: 'Bold and tangy, \nmakes your taste roar.', price: '13' },
    'onion,lettuce': { name: 'GREEN FANG', description: 'Fresh crunch with \na hidden snap.', price: '13' },
    'onion,cheese': { name: 'GOLDEN TEARS', description: 'Sweet onion wrapped \nin molten gold.', price: '13' },
    'onion,patty': { name: 'BEEFSTORM', description: 'Thunder of beef, \nflash of onion.', price: '15' },
    'tomato,lettuce': { name: 'GARDEN KISS', description: 'A soft kiss of \nfreshness and calm.', price: '15' },
    'tomato,cheese': { name: 'SUNBURST MELT', description: 'Sunny tomato draped \nin warm cheese.', price: '12' },
    'tomato,patty': { name: 'BLAZING BULL', description: 'Pure beef fury with \na tomato spark.', price: '13' },
    'lettuce,cheese': { name: 'EMERALD', description: 'Lush green bite \nwith golden warmth.', price: '15' },
    'lettuce,patty': { name: 'SAVANNAH', description: 'Wild and crisp from \nthe open fields.', price: '15' },
    'cheese,patty': { name: 'MIGHTY MELT', description: 'Heavy, cheesy, \nmelts the brave.', price: '17' },
    'onion,tomato,lettuce': { name: 'JUNGLE', description: 'Tangled greens \nand wild energy.', price: '17' },
    'onion,tomato,cheese': { name: 'INFERNO', description: 'Heat and fire tangled \nin golden bliss.', price: '17' },
    'onion,tomato,patty': { name: 'FIREFANG', description: 'Roaring beef with \na searing snap.', price: '17' },
    'onion,lettuce,cheese': { name: 'FROST FANG', description: 'Cool crunch biting \nthrough the melt.', price: '17' },
    'onion,lettuce,patty': { name: 'WILD HOWL', description: 'Rustic power with \na crisp growl.', price: '21' },
    'onion,cheese,patty': { name: 'MOLTEN BEAST', description: 'Lava cheese and \nroaring beef clash.', price: '17' },
    'tomato,lettuce,cheese': { name: 'SOLAR BLOOM', description: 'Bursting with sunny \ngarden charm.', price: '17' },
    'tomato,lettuce,patty': { name: 'SAVAGE', description: 'Fresh, fierce, wild \nand unstoppable.', price: '21' },
    'tomato,cheese,patty': { name: 'LAVA STACK', description: 'Beef and cheese \nerupting in glory.', price: '23' },
    'lettuce,cheese,patty': { name: 'THUNDER LEAF', description: 'Crunch strikes through \nmolten depths.', price: '21' },
    'onion,tomato,lettuce,cheese': { name: 'STORM CROWN', description: 'Crowned in greens, \nthunder below.', price: '21' },
    'onion,tomato,lettuce,patty': { name: 'JUNGLE KING', description: 'Wild reign of leaf \nand fire.', price: '23' },
    'onion,tomato,cheese,patty': { name: 'DRAGON FANG', description: 'Searing bite from \na molten beast.', price: '22' },
    'onion,lettuce,cheese,patty': { name: 'BEASTLORD', description: 'Crunch, melt, and \nprimal power.', price: '23' },
    'tomato,lettuce,cheese,patty': { name: 'PHOENIX BITE', description: 'Born from fire, \nfresh once more.', price: '25' },
    'onion,tomato,lettuce,cheese,patty': { name: 'OMEGA', description: 'Every layer. Every flavor. \nThe final boss.', price: '27' }
};

export function GetCurrentBurgerName(switchStates) {
    if (!Array.isArray(switchStates) || switchStates.length !== 5) {
        return 'THE VOID';
    }
    
    const ingredientNames = ['onion', 'tomato', 'lettuce', 'cheese', 'patty'];
    const ingredients = [];
    ingredientNames.forEach((name, index) => {
        if (switchStates[index] === true) {
            ingredients.push(name);
        }
    });
    
    const key = ingredients.join(',');
    const burger = BurgerNames[key] || BurgerNames[''];
    return burger.name;
}

export function GetBurgerData(switchStates) {
    if (!Array.isArray(switchStates) || switchStates.length !== 5) {
        return BurgerNames[''];
    }
    
    const ingredientNames = ['onion', 'tomato', 'lettuce', 'cheese', 'patty'];
    const ingredients = [];
    ingredientNames.forEach((name, index) => {
        if (switchStates[index] === true) {
            ingredients.push(name);
        }
    });
    
    const key = ingredients.join(',');
    return BurgerNames[key] || BurgerNames[''];
}
  