"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Dept } from "@/app/actions/user/get-dept";

import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateDialog({ depts }: { depts: { dept: Dept[] } }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create new</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create</DialogTitle>
          <DialogDescription>
            Add a new department or division.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="Department">
          <TabsList className="grid w-full grid-cols-2">
            {depts.dept.length > 1 && (
              <TabsTrigger value="department">Department</TabsTrigger>
            )}

            <TabsTrigger className="" value="division">
              Division
            </TabsTrigger>
          </TabsList>
          <TabsContent value="department">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name<span className="text-red-500">*</span>
                </Label>
                <Input id="name" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">
                  Code<span className="text-red-500">*</span>
                </Label>
                <Input
                  id="code"
                  required
                  aria-required="true"
                  placeholder="three letter code"
                  className="col-span-3"
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="division">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="Department" className="text-right">
                  Department<span className="text-red-500">*</span>
                </Label>
                <Select>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Departments</SelectLabel>

                      {depts.dept.length > 1 ? (
                        depts.dept.map(department => (
                          <SelectItem
                            value={department.id.toString()}
                            key={department.id}
                          >
                            {department.name} ({department.code})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem
                          value={depts.dept[0].id.toString()}
                          key={depts.dept[0].id}
                        >
                          {depts.dept[0].name} ({depts.dept[0].code})
                        </SelectItem>
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name<span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  required
                  aria-required="true"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">
                  Code<span className="text-red-500">*</span>
                </Label>
                <Input
                  id="code"
                  required
                  aria-required="true"
                  placeholder="three letter code"
                  className="col-span-3"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type="submit"
            onClick={() => {
              toast.success("Created successfully", {
                description: "The item has been created",
                action: {
                  label: "Undo",
                  onClick: () => {
                    toast.info("The item removed");
                  },
                },
              });
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default CreateDialog;
