const getCurrentTokenTitle = (teamSize, matchType) => {
  const getTokenSize = () => {
    switch (teamSize) {
      case 1:
        return "1v1";
      case 2:
        return "2v2";
      case 3:
        return "3v3";
      case 4:
        return "4v4";
      case 5:
        return "5v5";
    }
  };

  const getTokenMatchType = () => {
    switch (matchType) {
      case "ZW":
        return "Zone Wars";
      case "BOX":
        return "Box Fights";
      case "REAL":
        return "Realistics";
      case "PG":
        return "PG/Build Fights";
      case "RACE":
        return "Kill Race";
      case "ARENA_RACE":
        return "Arena Kill Race";
      case "ASCENT":
        return "Ascent";
      case "BIND":
        return "Bind";
      case "HAVEN":
        return "Haven";
      case "SPLIT":
        return "Split";
      case "FRACTURE":
        return "Fracture";
      case "ICEBOX":
        return "Icebox";
      case "BREEZE":
        return "Breeze";
      case "BATTLE":
        return "Battle";
      case "RAMPS":
        return "Ramps";
      case "BIG_ARENA":
        return "Big Arena";
      case "STABLES":
        return "Stables";
      case "PARK":
        return "Park";
      case "VANS":
        return "Vans";
      default:
        return null;
    }
  };

  return `${getTokenSize()} ${getTokenMatchType()}`;
};

const getCurrentTokenGame = (game) => {
  switch (game) {
    case "FN":
      return "Fortnite";
    case "VAL":
      return "Valorant";
    case "CLASH":
      return "CLASH";
    case "FIVEM":
      return "FiveM";
    default:
      return "Fortnite";
  }
};

const getCurrentTokenPrize = (entryFee) => {
  return parseFloat(entryFee) * 0.8;
};

module.exports = {
  getCurrentTokenTitle,
  getCurrentTokenPrize,
  getCurrentTokenGame,
};
