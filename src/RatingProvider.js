'use strict';

function RatingProvider() {}

RatingProvider.prototype.GetRating = function(parDictionary, strokeDictionary) {
	var bestUnder = 0;
	var worstOver = 0;
	var numberHolesOverUnder = 0;

	var total = Object.keys(strokeDictionary).reduce((sum, hole) => {
		var strokes = strokeDictionary[hole];
		var par = parDictionary[hole];
		var diff = strokes - par;
		if(diff > worstOver) { worstOver = diff; }
		if(diff < bestUnder) { bestUnder = diff; }
		if (diff < 0) { numberHolesOverUnder++; }
		if (diff > 0) { numberHolesOverUnder--; }
		return sum + diff;
	}, 0);
	var weightedScore = 13.0 - (((total * 0.5) + ((worstOver + bestUnder) * 0.2) + (numberHolesOverUnder * 0.3)) / 2.5);
	return Number(weightedScore.toFixed(5));
};

module.exports = RatingProvider;