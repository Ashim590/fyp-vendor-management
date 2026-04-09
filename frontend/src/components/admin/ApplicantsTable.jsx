import React from 'react'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { cn } from '@/lib/utils'
import { WORKSPACE_DATA_TABLE_CLASS } from '../layout/WorkspacePageLayout'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { MoreHorizontal } from 'lucide-react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { APPLICATION_API_END_POINT } from '@/utils/constant';
import axios from 'axios';

const shortlistingStatus = ["Accepted", "Rejected"];

const ApplicantsTable = () => {
    const { applicants } = useSelector(store => store.application);

    const statusHandler = async (status, id) => {
        try {
            axios.defaults.withCredentials = true;
            const res = await axios.post(`${APPLICATION_API_END_POINT}/status/${id}/update`, { status });
            if (res.data.success) {
                toast.success(res.data.message);
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Could not update status.");
        }
    }

    return (
        <div>
            <Table className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}>
                <TableCaption>A list of your recent applied user</TableCaption>
                <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[22%]" />
                    <col className="w-[12%]" />
                    <col className="w-[20%]" />
                    <col className="w-[10%]" />
                    <col className="w-[18%]" />
                </colgroup>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-left">FullName</TableHead>
                        <TableHead className="text-left">Email</TableHead>
                        <TableHead className="text-left">Contact</TableHead>
                        <TableHead className="text-left">Resume</TableHead>
                        <TableHead className="text-left">Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        applicants && applicants?.applications?.map((item) => (
                            <TableRow key={item._id}>
                                <TableCell className="min-w-0 truncate" title={item?.applicant?.fullname}>{item?.applicant?.fullname}</TableCell>
                                <TableCell className="min-w-0 truncate" title={item?.applicant?.email}>{item?.applicant?.email}</TableCell>
                                <TableCell className="min-w-0 truncate">{item?.applicant?.phoneNumber}</TableCell>
                                <TableCell className="min-w-0">
                                    {
                                        item.applicant?.profile?.resume ? <a className="truncate text-blue-600 underline-offset-2 hover:underline" href={item?.applicant?.profile?.resume} target="_blank" rel="noopener noreferrer">{item?.applicant?.profile?.resumeOriginalName}</a> : <span>NA</span>
                                    }
                                </TableCell>
                                <TableCell className="min-w-0 whitespace-nowrap">{item?.applicant.createdAt.split("T")[0]}</TableCell>
                                <TableCell className="min-w-0 text-right cursor-pointer">
                                    <Popover>
                                        <PopoverTrigger>
                                            <MoreHorizontal />
                                        </PopoverTrigger>
                                        <PopoverContent className="w-32">
                                            {
                                                shortlistingStatus.map((status, index) => {
                                                    return (
                                                        <div onClick={() => statusHandler(status, item?._id)} key={index} className='flex w-fit items-center my-2 cursor-pointer'>
                                                            <span>{status}</span>
                                                        </div>
                                                    )
                                                })
                                            }
                                        </PopoverContent>
                                    </Popover>

                                </TableCell>

                            </TableRow>
                        ))
                    }

                </TableBody>

            </Table>
        </div>
    )
}

export default ApplicantsTable