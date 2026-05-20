import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Signup() {
  const { t } = useTranslation();

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 py-16 bg-muted/30">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-sm">
              <div className="w-4 h-4 bg-white rounded-full" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">{t("create_account")}</h1>
            <p className="text-muted-foreground text-sm mt-1.5">{t("signup_sub")}</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-7 card-shadow">
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">{t("display_name")}</Label>
                <Input id="name" placeholder={t("display_name_ph")} className="rounded-lg h-10 bg-background border-border" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">{t("email")}</Label>
                <Input id="email" type="email" placeholder="name@example.com" className="rounded-lg h-10 bg-background border-border" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">{t("password")}</Label>
                <Input id="password" type="password" placeholder={t("create_pw_ph")} className="rounded-lg h-10 bg-background border-border" />
              </div>

              <p className="text-xs text-muted-foreground pt-1">
                {t("agree_text")}{" "}
                <Link href="/terms" className="text-primary hover:underline font-medium">{t("terms_of_service")}</Link>
                {" "}{t("and")}{" "}
                <Link href="/privacy" className="text-primary hover:underline font-medium">{t("privacy_policy_label")}</Link>.
              </p>

              <Button className="w-full bg-primary text-white font-semibold rounded-lg h-10 shadow-sm hover:bg-primary/90" size="default">
                {t("create_account_btn")}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("already_account")}{" "}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              {t("log_in")}
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
