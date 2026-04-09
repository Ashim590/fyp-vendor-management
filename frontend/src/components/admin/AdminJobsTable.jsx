import React, { useEffect, useState } from 'react'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { cn } from '@/lib/utils'
import { WORKSPACE_DATA_TABLE_CLASS } from '../layout/WorkspacePageLayout'
import { Avatar, AvatarImage } from '../ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Edit2, Eye, MoreHorizontal } from 'lucide-react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

const AdminJobsTable = () => { 
    const {allAdminJobs, searchJobByText} = useSelector(store=>store.job);

    const [filterJobs, setFilterJobs] = useState(allAdminJobs);
    const navigate = useNavigate();

    useEffect(()=>{
        const filteredJobs = allAdminJobs.filter((job)=>{
            if(!searchJobByText){
                return true;
            };
            return job?.title?.toLowerCase().includes(searchJobByText.toLowerCase()) || job?.company?.name.toLowerCase().includes(searchJobByText.toLowerCase());

        });
        setFilterJobs(filteredJobs);
    },[allAdminJobs,searchJobByText])
    return (
        <div>
            <Table className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}>
                <TableCaption>A list of your recent  posted jobs</TableCaption>
                <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[36%]" />
                    <col className="w-[20%]" />
                    <col className="w-[14%]" />
                </colgroup>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-left">Company Name</TableHead>
                        <TableHead className="text-left">Role</TableHead>
                        <TableHead className="text-left">Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        filterJobs?.map((job) => (
                            <TableRow key={job._id}>
                                <TableCell className="min-w-0 truncate">{job?.company?.name}</TableCell>
                                <TableCell className="min-w-0 truncate">{job?.title}</TableCell>
                                <TableCell className="min-w-0 whitespace-nowrap">{job?.createdAt.split("T")[0]}</TableCell>
                                <TableCell className="min-w-0 text-right cursor-pointer">
                                    <Popover>
                                        <PopoverTrigger><MoreHorizontal /></PopoverTrigger>
                                        <PopoverContent className="w-32">
                                            <div onClick={()=> navigate(`/admin/companies/${job._id}`)} className='flex items-center gap-2 w-fit cursor-pointer'>
                                                <Edit2 className='w-4' />
                                                <span>Edit</span>
                                            </div>
                                            <div onClick={()=> navigate(`/admin/jobs/${job._id}/applicants`)} className='flex items-center w-fit gap-2 cursor-pointer mt-2'>
                                                <Eye className='w-4'/>
                                                <span>Applicants</span>
                                            </div>
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

export default AdminJobsTable