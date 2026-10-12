import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { DataStatusButton } from './data-status-icon';
import { DateBar } from './date-bar';

export function EntryHeader({ children }: { children?: ReactNode }) {
  const [height, setHeight] = useState(148);
  return (
    <ScrollView
      testID="entry-header"
      style={{
        height,
        flexGrow: 0,
        flexShrink: 1,
        minHeight: 64,
        overflow: 'hidden',
      }}
      onContentSizeChange={(_width, contentHeight) =>
        setHeight(Math.ceil(contentHeight))
      }
      contentContainerStyle={{
        padding: 20,
        paddingTop: 4,
        alignItems: 'center',
      }}
    >
      <View style={{ width: '100%', maxWidth: 420, gap: 12 }}>
        <DataStatusButton />
        <DateBar />
        {children}
      </View>
    </ScrollView>
  );
}
