export class SlugUtil {
  static generate(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // remove non-word chars
      .replace(/[\s_-]+/g, '-') // swap spaces/underscores for single dash
      .replace(/^-+|-+$/g, ''); // trim starting/ending dashes
  }
}
