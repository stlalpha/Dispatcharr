import React from 'react';
import ChannelsTable from '../components/tables/ChannelsTable';
import StreamsTable from '../components/tables/StreamsTable';
import { Box, Stack } from '@mantine/core';
import { Allotment } from 'allotment';
import { USER_LEVELS } from '../constants';
import useAuthStore from '../store/auth';
import useLocalStorage from '../hooks/useLocalStorage';
import { useResponsive } from '../hooks/useResponsive';

const ChannelsPage = () => {
  const authUser = useAuthStore((s) => s.user);
  const { isMobile } = useResponsive();
  const [allotmentSizes, setAllotmentSizes] = useLocalStorage(
    'channels-splitter-sizes',
    [50, 50]
  );

  const handleSplitChange = (sizes) => {
    setAllotmentSizes(sizes);
  };

  const handleResize = (sizes) => {
    setAllotmentSizes(sizes);
  };

  if (!authUser.id) {
    return <></>;
  }
  if (authUser.user_level <= USER_LEVELS.STANDARD) {
    return (
      <Box style={{ padding: isMobile ? 8 : 10 }}>
        <ChannelsTable />
      </Box>
    );
  }

  // Mobile: Stack vertically instead of split view
  if (isMobile) {
    return (
      <Stack gap={0} style={{ height: '100%', width: '100%' }}>
        <Box style={{ padding: 8, flex: 1, overflow: 'auto' }}>
          <ChannelsTable />
        </Box>
      </Stack>
    );
  }

  // Desktop: Split view with Allotment
  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        overflowX: 'auto',
      }}
    >
      <Allotment
        defaultSizes={allotmentSizes}
        style={{ height: '100%', width: '100%', minWidth: '600px' }}
        className="custom-allotment"
        minSize={100}
        onChange={handleSplitChange}
        onResize={handleResize}
      >
        <div style={{ padding: 10, overflowX: 'auto', minWidth: '100px' }}>
          <div style={{ minWidth: '600px' }}>
            <ChannelsTable />
          </div>
        </div>
        <div style={{ padding: 10, overflowX: 'auto', minWidth: '100px' }}>
          <div style={{ minWidth: '600px' }}>
            <StreamsTable />
          </div>
        </div>
      </Allotment>
    </div>
  );
};

export default ChannelsPage;
