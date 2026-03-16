import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '../constants/theme';

interface Props {
  status: 'no_face' | 'misaligned' | 'aligned';
  width: number;
  height: number;
}

// --- Vertices ---
// Carefully placed to form a face-recognition-style wireframe mesh.
// Symmetric about x = 150.  y increases downward.
// prettier-ignore
const V: [number, number][] = [
  // ---- CONTOUR (outer face silhouette, 0-23) ----
  [150,  8],  // 0  top of skull
  [118, 14],  // 1
  [182, 14],  // 2
  [ 90, 30],  // 3
  [210, 30],  // 4
  [ 68, 56],  // 5
  [232, 56],  // 6
  [ 54, 88],  // 7
  [246, 88],  // 8
  [ 48,120],  // 9
  [252,120],  // 10
  [ 46,155],  // 11
  [254,155],  // 12
  [ 50,190],  // 13
  [250,190],  // 14
  [ 58,222],  // 15
  [242,222],  // 16
  [ 74,252],  // 17
  [226,252],  // 18
  [ 96,278],  // 19
  [204,278],  // 20
  [120,298],  // 21
  [180,298],  // 22
  [150,308],  // 23

  // ---- FOREHEAD INTERIOR (24-39) ----
  [150, 20],  // 24
  [120, 24],  // 25
  [180, 24],  // 26
  [ 98, 38],  // 27
  [150, 34],  // 28
  [202, 38],  // 29
  [ 78, 56],  // 30
  [120, 50],  // 31
  [150, 48],  // 32
  [180, 50],  // 33
  [222, 56],  // 34
  [ 68, 74],  // 35
  [108, 68],  // 36
  [150, 66],  // 37
  [192, 68],  // 38
  [232, 74],  // 39

  // ---- BROW RIDGE (40-49) ----
  [ 60, 92],  // 40
  [ 82, 88],  // 41
  [100, 86],  // 42
  [120, 90],  // 43
  [138, 96],  // 44
  [162, 96],  // 45
  [180, 90],  // 46
  [200, 86],  // 47
  [218, 88],  // 48
  [240, 92],  // 49

  // ---- LEFT EYE (50-59) ----
  [ 76,108],  // 50  outer corner
  [ 88,102],  // 51  upper outer
  [104, 98],  // 52  upper mid
  [118,100],  // 53  upper inner
  [128,108],  // 54  inner corner
  [118,114],  // 55  lower inner
  [104,116],  // 56  lower mid
  [ 88,114],  // 57  lower outer
  [ 76,112],  // 58  outer lower
  [104,108],  // 59  pupil center

  // ---- RIGHT EYE (60-69) ----
  [224,108],  // 60  outer corner
  [212,102],  // 61  upper outer
  [196, 98],  // 62  upper mid
  [182,100],  // 63  upper inner
  [172,108],  // 64  inner corner
  [182,114],  // 65  lower inner
  [196,116],  // 66  lower mid
  [212,114],  // 67  lower outer
  [224,112],  // 68  outer lower
  [196,108],  // 69  pupil center

  // ---- NOSE (70-83) ----
  [150,100],  // 70  bridge top
  [142,112],  // 71  bridge left
  [158,112],  // 72  bridge right
  [138,128],  // 73  mid bridge left
  [150,124],  // 74  mid bridge center
  [162,128],  // 75  mid bridge right
  [132,148],  // 76  lower bridge left
  [150,144],  // 77  lower bridge center
  [168,148],  // 78  lower bridge right
  [122,166],  // 79  nose wing left
  [138,164],  // 80  nostril left
  [150,168],  // 81  nose tip
  [162,164],  // 82  nostril right
  [178,166],  // 83  nose wing right

  // ---- UNDER-EYE / UPPER CHEEK (84-93) ----
  [ 56,130],  // 84
  [ 78,128],  // 85
  [102,126],  // 86
  [124,126],  // 87
  [176,126],  // 88
  [198,126],  // 89
  [222,128],  // 90
  [244,130],  // 91
  [ 52,152],  // 92
  [248,152],  // 93

  // ---- MID CHEEK (94-101) ----
  [ 56,172],  // 94
  [ 82,166],  // 95
  [106,158],  // 96
  [194,158],  // 97
  [218,166],  // 98
  [244,172],  // 99
  [ 80,144],  // 100
  [220,144],  // 101

  // ---- NASOLABIAL / MOUTH AREA (102-127) ----
  [ 60,198],  // 102
  [ 86,192],  // 103
  [108,184],  // 104
  [130,178],  // 105
  [150,182],  // 106
  [170,178],  // 107
  [192,184],  // 108
  [214,192],  // 109
  [240,198],  // 110
  // upper lip
  [112,202],  // 111
  [130,196],  // 112
  [142,200],  // 113
  [150,198],  // 114
  [158,200],  // 115
  [170,196],  // 116
  [188,202],  // 117
  // mouth line
  [116,212],  // 118
  [134,210],  // 119
  [150,212],  // 120
  [166,210],  // 121
  [184,212],  // 122
  // lower lip
  [120,222],  // 123
  [136,224],  // 124
  [150,226],  // 125
  [164,224],  // 126
  [180,222],  // 127

  // ---- CHIN / JAW (128-149) ----
  [ 66,230],  // 128
  [ 88,228],  // 129
  [108,232],  // 130
  [150,236],  // 131
  [192,232],  // 132
  [212,228],  // 133
  [234,230],  // 134
  [ 78,252],  // 135
  [104,254],  // 136
  [132,256],  // 137
  [150,258],  // 138
  [168,256],  // 139
  [196,254],  // 140
  [222,252],  // 141
  [100,278],  // 142
  [130,282],  // 143
  [150,286],  // 144
  [170,282],  // 145
  [200,278],  // 146
  [124,298],  // 147
  [150,302],  // 148
  [176,298],  // 149
];

// Build triangles that form the mesh.
// prettier-ignore
const T: [number, number, number][] = [
  // === SKULL CAP ===
  [0,1,24],[0,2,24],[1,24,25],[2,24,26],[24,25,28],[24,26,28],
  [1,3,25],[2,4,26],[3,25,27],[4,26,29],[25,27,31],[25,28,31],[26,28,33],[26,29,33],[28,31,32],[28,32,33],
  [3,5,27],[4,6,29],[27,30,31],[29,33,34],[5,27,30],[6,29,34],

  // === FOREHEAD ===
  [5,30,35],[6,34,39],[30,31,36],[30,35,36],[31,32,37],[31,36,37],[32,33,37],[33,38,37],[33,34,38],[34,39,38],
  [5,7,35],[6,8,39],[35,36,41],[35,40,41],[36,37,42],[36,41,42],[37,43,42],[37,44,43],[37,45,44],[37,38,45],
  [38,46,45],[38,47,46],[38,48,47],[38,39,48],[39,49,48],[7,35,40],[8,39,49],

  // === BROW TO EYE ===
  [7,40,9],[8,49,10],[40,41,50],[41,42,51],[42,43,52],[43,44,53],[44,54,53],[44,45,70],[44,70,54],
  [45,70,64],[45,46,64],[46,63,64],[46,47,62],[46,62,63],[47,48,61],[48,49,60],[48,60,61],

  // === LEFT EYE ===
  [50,51,57],[51,52,56],[51,56,57],[52,53,55],[52,55,56],[53,54,55],
  [50,57,58],[55,56,59],[56,57,59],[52,53,59],[53,55,59],[50,51,59],[51,52,59],

  // === RIGHT EYE ===
  [60,61,67],[61,62,66],[61,66,67],[62,63,65],[62,65,66],[63,64,65],
  [60,67,68],[65,66,69],[66,67,69],[62,63,69],[63,65,69],[60,61,69],[61,62,69],

  // === UNDER EYE / UPPER CHEEK ===
  [9,50,84],[9,84,11],[50,58,85],[58,57,85],[57,56,86],[56,55,87],[55,54,87],
  [10,60,91],[10,91,12],[60,68,90],[68,67,90],[67,66,89],[66,65,88],[65,64,88],
  [54,71,87],[64,72,88],[84,85,100],[85,86,100],[91,90,101],[90,89,101],

  // === NOSE BRIDGE ===
  [70,71,74],[70,72,74],[71,73,74],[72,75,74],[73,74,77],[74,75,77],
  [54,70,71],[64,70,72],[71,73,87],[72,75,88],

  // === NOSE LOWER ===
  [73,76,77],[75,77,78],[76,77,81],[77,78,81],[76,79,80],[76,80,81],[78,82,81],[78,83,82],
  [79,80,81],[81,82,83],

  // === CHEEKS ===
  [11,84,92],[12,91,93],[92,84,100],[93,91,101],[92,94,100],[93,99,101],
  [100,95,96],[100,85,95],[86,96,100],[87,96,73],[101,98,97],[101,90,98],[89,97,101],[88,97,75],
  [11,92,13],[12,93,14],[92,94,13],[93,99,14],
  [94,95,102],[95,96,104],[96,79,105],[83,97,107],[97,98,108],[98,99,109],
  [13,94,102],[14,99,110],[102,95,103],[95,104,103],[109,98,110],

  // === NASOLABIAL ===
  [79,105,80],[83,107,82],[80,105,106],[80,106,81],[82,107,106],[82,106,81],
  [96,104,105],[97,108,107],[105,106,112],[106,107,116],[105,112,111],[107,116,117],
  [104,105,111],[108,107,117],

  // === UPPER LIP ===
  [111,112,118],[112,113,119],[112,119,118],[113,114,119],[114,120,119],[114,115,120],[115,121,120],
  [115,116,121],[116,122,121],[116,117,122],

  // === LOWER LIP ===
  [118,119,123],[119,120,124],[119,124,123],[120,121,125],[120,125,124],[121,122,126],[121,126,125],[122,127,126],

  // === MOUTH CORNERS TO CHEEK ===
  [13,102,15],[14,110,16],[15,102,128],[16,110,134],[102,103,128],[103,129,128],
  [103,104,129],[104,111,130],[111,118,130],[109,117,132],[117,122,132],[109,110,133],[110,134,133],

  // === CHIN ===
  [123,124,130],[124,125,131],[124,131,130],[125,126,131],[126,132,131],[126,127,132],
  [15,128,17],[16,134,18],[128,129,135],[129,130,136],[130,131,137],[130,137,136],[131,138,137],
  [131,132,138],[132,139,138],[132,133,140],[133,134,141],[134,141,18],
  [17,135,19],[18,141,20],[135,136,142],[136,137,143],[137,138,143],[138,144,143],
  [138,139,144],[139,145,144],[139,140,145],[140,141,146],
  [19,142,21],[20,146,22],[142,143,147],[143,144,148],[144,145,148],[145,149,148],[145,146,149],
  [21,147,23],[22,149,23],[147,148,23],[148,149,23],
];

// Build unique edges from triangles
function buildEdges(tris: [number, number, number][]): [number, number][] {
  const set = new Set<string>();
  const result: [number, number][] = [];
  for (const [a, b, c] of tris) {
    for (const [p, q] of [[a, b], [b, c], [a, c]] as [number, number][]) {
      const key = p < q ? `${p}-${q}` : `${q}-${p}`;
      if (!set.has(key)) {
        set.add(key);
        result.push([p, q]);
      }
    }
  }
  return result;
}

const edges = buildEdges(T);

const AnimatedView = Animated.View;

export const CameraFaceMesh: React.FC<Props> = ({ status, width, height }) => {
  const meshOpacity = useSharedValue(0.25);
  const glowOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (status === 'no_face') {
      meshOpacity.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 750 }),
          withTiming(0.15, { duration: 750 }),
        ),
        -1,
      );
      glowOpacity.value = withTiming(0, { duration: 300 });
    } else if (status === 'misaligned') {
      meshOpacity.value = withTiming(0.3, { duration: 300 });
      glowOpacity.value = withTiming(0, { duration: 300 });
    } else {
      meshOpacity.value = withTiming(0.85, { duration: 400 });
      glowOpacity.value = withTiming(0.6, { duration: 400 });
    }
  }, [status]);

  const meshStyle = useAnimatedStyle(() => ({
    opacity: meshOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const meshColor = status === 'aligned' ? Colors.primary : 'rgba(255, 255, 255, 0.7)';
  const vertexColor = status === 'aligned' ? Colors.primaryLight : 'rgba(255, 255, 255, 0.5)';

  // Scale mesh to fit camera dimensions
  const scaleX = width / 300;
  const scaleY = height / 380;

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      {/* Glow behind mesh when aligned */}
      <AnimatedView style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <RadialGradient id="meshGlow" cx="50%" cy="45%" r="40%">
              <Stop offset="0%" stopColor={Colors.primary} stopOpacity="0.25" />
              <Stop offset="60%" stopColor={Colors.primary} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={Colors.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={width / 2} cy={height * 0.45} r={width * 0.4} fill="url(#meshGlow)" />
        </Svg>
      </AnimatedView>

      {/* Wireframe mesh */}
      <AnimatedView style={[StyleSheet.absoluteFill, meshStyle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <G>
            {edges.map(([a, b], i) => (
              <Line
                key={i}
                x1={V[a][0] * scaleX}
                y1={V[a][1] * scaleY}
                x2={V[b][0] * scaleX}
                y2={V[b][1] * scaleY}
                stroke={meshColor}
                strokeWidth={0.8}
              />
            ))}
          </G>
          <G>
            {V.map(([x, y], i) => {
              const isContour = i <= 23;
              const isEye = i >= 50 && i <= 69;
              const isNose = i >= 70 && i <= 83;
              const isLip = i >= 111 && i <= 127;
              const bright = isContour || isEye || isNose || isLip;
              return (
                <Circle
                  key={i}
                  cx={x * scaleX}
                  cy={y * scaleY}
                  r={bright ? 2.0 : 1.2}
                  fill={vertexColor}
                  opacity={bright ? 0.8 : 0.4}
                />
              );
            })}
          </G>
        </Svg>
      </AnimatedView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
