declare module 'react-native-vector-icons/FontAwesome' {
  import { Component } from 'react';
  import { TextStyle, ViewStyle } from 'react-native';

  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | ViewStyle;
  }

  class Icon extends Component<IconProps> {
    static getImageSource(
      name: string,
      size?: number,
      color?: string
    ): Promise<any>;
    static getImageSourceSync(
      name: string,
      size?: number,
      color?: string
    ): any;
    static loadFont(
      file?: string
    ): Promise<void>;
    static hasIcon(name: string): boolean;
  }

  export = Icon;
}