import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

export const useResponsive = () => {
  const theme = useTheme();
  
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 900px
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg')); // 900px - 1200px
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px
  
  // Specific device breakpoints
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const isMediumMobile = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600px - 900px
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    isSmallMobile,
    isMediumMobile,
    // Convenience flags
    isMobileOrTablet: isMobile || isTablet,
    isSmallScreen: isSmallMobile,
    isTouchDevice: isMobile || isTablet
  };
};

export default useResponsive;
