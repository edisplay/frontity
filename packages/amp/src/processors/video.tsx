import { Processor, Element } from "@frontity/html2react/types";
import { Packages } from "../../types";
import { Head } from "frontity";

/**
 * Props for the {@link AMPVideo} component.
 */
interface VideoProps {
  /**
   * The className that might be passed to the component after being
   * having been generated by the emotion babel plugin.
   */
  className: string;

  /**
   * Corresponds to the `autoplay` property of the `<video>` element.
   */
  autoPlay: string;

  /**
   * Corresponds to the `loop` property of the `<video>` element.
   */
  loop: string;

  /**
   * Corresponds to the `controls` property of the `<video>` element.
   */
  controls: string;

  /**
   * Corresponds to the `muted` property of the `<video>` element.
   */
  muted: string;
}

/**
 * The component that renders an amp-video component in place of a regular
 * video and adds the required AMP script for amp-video in the head.
 *
 * @param props - The props to pass the the amp-video.
 *
 * @returns A react component.
 */
const AMPVideo: React.FC<VideoProps> = ({
  className,
  autoPlay,
  loop,
  controls,
  muted,
  ...props
}) => {
  return (
    <>
      <Head>
        <script
          // We have to explicitly pass undefined, otherwise the attribute is
          // passed to the DOM like async="true" and AMP does not allow that.
          async={undefined}
          custom-element="amp-video"
          src="https://cdn.ampproject.org/v0/amp-video-0.1.js"
        />
      </Head>
      <amp-video
        class={className}
        // If the attribute's value is truthy, we set it to "" so that
        // the attribute appears as a boolean without a value, like: <video
        // loop>
        // This is required per AMP validation rules
        // https://stackoverflow.com/a/50996065/2638310
        {...props}
        {...(autoPlay ? { autoPlay: "" } : undefined)}
        {...(controls ? { controls: "" } : undefined)}
        {...(loop ? { loop: "" } : undefined)}
        {...(muted ? { muted: "" } : undefined)}
      />
    </>
  );
};

export const video: Processor<Element, Packages> = {
  name: "amp-video",
  test: ({ node }) => node.component === "video",
  processor: ({ node }) => {
    node.component = AMPVideo;

    // AMP requires that the file is loaded over HTTPS
    const httpRegexp = /^http:\/\//;
    if (node.props?.src?.match(httpRegexp)) {
      node.props.src = node.props.src.replace(httpRegexp, "https://");
    }

    // For now if the video does not specify width & height we default to
    // a 9:16 aspect ratio.
    const width = node.props.width || node.props["data-origwidth"];
    const height = node.props.width || node.props["data-origheight"];
    if (parseInt(width, 10) > 0 && parseInt(height, 10) > 0) {
      node.props.width = width;
      node.props.height = height;
    } else {
      // When used together with layout="responsive", it does not mean that the
      // video will have a specific height & width but rather that it will scale
      // responsively preserving the aspect ratio between the height and width.
      node.props.height = 9;
      node.props.width = 16;
    }

    node.props["layout"] = "responsive";

    return node;
  },
};
