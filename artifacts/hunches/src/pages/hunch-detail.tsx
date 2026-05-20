import { useState } from "react";
import { useParams, Link } from "wouter";
import { formatDistanceToNow, format, isPast } from "date-fns";
import { ArrowLeft, Users, Clock, Share2, AlertCircle, Info, Trophy, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useGetHunch, useSubmitPrediction, getGetHunchQueryKey } from "@workspace/api-client-react";

export default function HunchDetail() {
  const { id } = useParams<{ id: string }>();
  const hunchId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const { data: hunch, isLoading, error } = useGetHunch(hunchId, { 
    query: { enabled: !!hunchId } 
  });

  const submitPrediction = useSubmitPrediction();

  const handlePredict = () => {
    if (!selectedOption) return;
    
    submitPrediction.mutate({ 
      id: hunchId, 
      data: { optionId: selectedOption } 
    }, {
      onSuccess: () => {
        toast({
          title: "Prediction submitted!",
          description: "Your hunch has been recorded. Good luck!",
        });
        queryClient.invalidateQueries({ queryKey: getGetHunchQueryKey(hunchId) });
      },
      onError: (err: any) => {
        toast({
          title: "Error",
          description: err.error || "Failed to submit prediction",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="w-24 h-6 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !hunch) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">Hunch not found</h1>
          <p className="text-muted-foreground mb-6">The prediction you're looking for doesn't exist or has been removed.</p>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const isOpen = hunch.status === 'open' && !isPast(new Date(hunch.endsAt));
  const isResolved = hunch.status === 'resolved';

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to all hunches
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge variant="outline" className={`${hunch.status === 'open' ? 'bg-accent/20 text-accent border-accent/50' : 'bg-muted text-muted-foreground'} tracking-wider text-xs`}>
                  {hunch.status.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="bg-card text-muted-foreground border-border">
                  {hunch.categoryName}
                </Badge>
              </div>
              <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground leading-[1.1] mb-6">
                {hunch.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground pb-6 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="font-medium text-foreground">{hunch.participantCount.toLocaleString()}</span> participants
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {isOpen ? (
                    <span>Ends {format(new Date(hunch.endsAt), "MMM d, yyyy 'at' h:mm a")}</span>
                  ) : (
                    <span>Ended {format(new Date(hunch.endsAt), "MMM d, yyyy")}</span>
                  )}
                </div>
              </div>
            </div>

            {hunch.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-border/50 bg-card">
                <img src={hunch.imageUrl} alt={hunch.title} className="w-full max-h-[400px] object-cover" />
              </div>
            )}

            <div>
              <h3 className="text-xl font-display font-bold mb-4">The Context</h3>
              <div className="prose prose-invert prose-primary max-w-none text-muted-foreground text-lg leading-relaxed">
                {hunch.description}
              </div>
            </div>
            
            <div className="bg-muted/30 border border-border/50 rounded-xl p-6 flex items-start gap-4">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <strong className="text-foreground block mb-1">How resolution works</strong>
                This hunch will be resolved based on official announcements or verifiable public data. If the outcome is ambiguous, the prize may be split or refunded according to our terms of service. No money is wagered.
              </div>
            </div>
          </div>

          {/* Sidebar / Action Area */}
          <div className="space-y-6">
            {/* Prize Card */}
            <div className="bg-gradient-to-b from-primary/10 to-transparent border border-primary/20 rounded-xl p-1 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[50px] pointer-events-none" />
              <div className="bg-card/80 backdrop-blur-md rounded-lg p-6 relative z-10">
                <div className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> PRIZE POOL
                </div>
                <div className="text-3xl font-display font-bold text-foreground mb-1">
                  {hunch.prize.value}
                </div>
                <div className="text-muted-foreground">
                  {hunch.prize.label}
                </div>
              </div>
            </div>

            {/* Prediction Card */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl relative z-20">
              <h3 className="font-display font-bold text-xl mb-6">
                {isResolved ? "Final Results" : "Make your prediction"}
              </h3>
              
              <div className="space-y-4 mb-8">
                {hunch.options.map((option) => {
                  const isWinner = isResolved && hunch.winnerOption === option.label;
                  const isSelected = selectedOption === option.id;
                  
                  return (
                    <button
                      key={option.id}
                      disabled={!isOpen}
                      onClick={() => setSelectedOption(option.id)}
                      className={`w-full text-left relative overflow-hidden rounded-lg border p-4 transition-all duration-200 group ${
                        isWinner 
                          ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.15)]" 
                          : isSelected
                            ? "border-accent bg-accent/5 ring-1 ring-accent"
                            : "border-border bg-background hover:border-primary/50"
                      } ${!isOpen && !isWinner ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {/* Background progress bar */}
                      <div 
                        className={`absolute left-0 top-0 bottom-0 opacity-10 ${isWinner ? 'bg-primary' : 'bg-foreground'}`} 
                        style={{ width: `${option.percentage}%` }} 
                      />
                      
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isWinner ? 'border-primary text-primary' : 
                            isSelected ? 'border-accent bg-accent' : 
                            'border-muted-foreground'
                          }`}>
                            {isWinner && <CheckCircle2 className="w-4 h-4" />}
                            {isSelected && !isWinner && <div className="w-2 h-2 rounded-full bg-background" />}
                          </div>
                          <span className={`font-semibold ${isWinner ? 'text-primary' : 'text-foreground'}`}>
                            {option.label}
                          </span>
                        </div>
                        <span className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
                          {Math.round(option.percentage)}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {isOpen ? (
                <Button 
                  className="w-full font-bold text-lg h-14 bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-all hover:scale-[1.02]"
                  disabled={!selectedOption || submitPrediction.isPending}
                  onClick={handlePredict}
                >
                  {submitPrediction.isPending ? "Submitting..." : "Lock in Prediction"}
                </Button>
              ) : (
                <div className="w-full text-center p-4 bg-muted/50 rounded-lg text-muted-foreground font-medium">
                  {isResolved ? "This hunch is resolved." : "Predictions are closed."}
                </div>
              )}
            </div>
            
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1">
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
