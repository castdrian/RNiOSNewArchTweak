import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  systemVersion(): string;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeTestModule');
