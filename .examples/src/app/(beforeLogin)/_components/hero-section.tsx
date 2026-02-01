import { Button } from '@/components/ui/button'

export default function HeroSection() {
  return (
    <section className="from-background to-muted/50 flex w-full items-center justify-center overflow-hidden bg-gradient-to-b py-20 md:py-28">
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col justify-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
              Simplify Your Ansible Workflow
            </h1>
            <p className="text-muted-foreground max-w-[600px] md:text-xl">
              Design, visualize, and deploy Ansible playbooks with our intuitive
              flow editor. No more complex YAML files.
            </p>
          </div>
          <div className="flex flex-col gap-2 min-[400px]:flex-row">
            <Button size="lg" className="px-8">
              Get Started
            </Button>
            <Button size="lg" variant="outline" className="px-8">
              Learn More
            </Button>
          </div>
        </div>
        <div className="flex w-full items-center justify-center">
          <div className="bg-background relative aspect-video w-full max-w-[500px] overflow-hidden rounded-lg border shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-4/5 w-4/5 rounded-lg bg-white/90 p-4 shadow-lg dark:bg-gray-900/90">
                  <div className="flex h-full flex-col">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex space-x-2">
                        <div className="h-3 w-3 rounded-full bg-red-500"></div>
                        <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      </div>
                      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                    <div className="grid flex-1 grid-cols-3 gap-2">
                      <div className="col-span-1 rounded bg-gray-100 p-2 dark:bg-gray-800">
                        <div className="mb-2 h-4 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
                        <div className="mb-2 h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
                        <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
                      </div>
                      <div className="col-span-2 rounded bg-gray-50 p-2 dark:bg-gray-800/50">
                        <div className="flex h-full items-center justify-center">
                          <div className="grid w-full grid-cols-2 gap-4">
                            <div className="flex h-8 w-full items-center justify-center rounded bg-blue-100 dark:bg-blue-900/30">
                              <div className="h-4 w-4 rounded-full bg-blue-500"></div>
                            </div>
                            <div className="flex h-8 w-full items-center justify-center rounded bg-purple-100 dark:bg-purple-900/30">
                              <div className="h-4 w-4 rounded-full bg-purple-500"></div>
                            </div>
                            <div className="flex h-8 w-full items-center justify-center rounded bg-green-100 dark:bg-green-900/30">
                              <div className="h-4 w-4 rounded-full bg-green-500"></div>
                            </div>
                            <div className="flex h-8 w-full items-center justify-center rounded bg-amber-100 dark:bg-amber-900/30">
                              <div className="h-4 w-4 rounded-full bg-amber-500"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
