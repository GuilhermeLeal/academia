import { LayoutAnimation } from 'react-native';

const subtleLayoutTransition = {
  duration: 180,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

export function animateNextLayout(reducedMotion: boolean) {
  if (!reducedMotion) LayoutAnimation.configureNext(subtleLayoutTransition);
}
