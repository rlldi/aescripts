//↓prototypeにする？　でもそもそも何オブジェクトだ？

//timeToNextMarker
if (marker && marker.numKeys > 0) {
	n = marker.nearestKey(time);
	prevIdx = n.index - (n.time > time);
	nextIdx = prevIdx + (prevIdx < marker.numKeys);
	marker.key(nextIdx).time - time;
} else -time;

//timeFromPrevMarker
if (marker && marker.numKeys > 0) {
	n = marker.nearestKey(time);
	prevIdx = n.index - (n.time > time);
	if (prevIdx > 0) time - marker.key(prevIdx).time;
	else -1;
} else -1;