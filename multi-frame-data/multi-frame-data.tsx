import { useDataLoader, useImFusion, useVisibleData } from '@imfusion/sdk-react';
import { FrameSelection } from '@imfusion/web-ui/integrations/frame-selection';
import { useEffect, useRef, useState } from 'react';

export default function FrameSliderWidget() {
  const imf = useImFusion();
  const { loadFileFromUrl, error } = useDataLoader();
  const visibleData = useVisibleData();
  const [loading, setLoading] = useState(true);

  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    Promise.all([
      loadFileFromUrl(new URL('../example_data/Ultrasound/img.imf', import.meta.url).href), // multi-frame
      loadFileFromUrl(new URL('../example_data/CT/img.imf', import.meta.url).href), // single-frame
    ])
      .then(() => {
        imf.showAll(imf.dataModel.getImages());
        setLoading(false);
      })
      .catch(() => {});
  }, [imf, loadFileFromUrl]);

  if (error) return <p style={{ fontSize: 14 }}>Failed to load the sample volume: {error.message}</p>;
  if (loading) return <p style={{ fontSize: 14 }}>Loading data…</p>;

  return <FrameSelection data={visibleData} orientation={'horizontal'}></FrameSelection>;
}
